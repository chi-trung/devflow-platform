using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using DevFlow.Api.Auth;
using DevFlow.Api.Hubs;
using DevFlow.Api.Middleware;
using DevFlow.Api.RealTime;
using DevFlow.Application;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Infrastructure;
using DevFlow.Infrastructure.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, configuration) =>
    configuration.ReadFrom.Configuration(context.Configuration));

builder.Services.AddApplication();

builder.Services.AddInfrastructure(builder.Configuration);

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer();

builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtSettings>>((bearer, jwtSettings) =>
    {
        bearer.MapInboundClaims = false;

        bearer.Events = new JwtBearerEvents
        {
            // SignalR WebSockets cannot send an Authorization header,
            // so the access token arrives via the query string.
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) &&
                    path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            }
        };

        bearer.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings.Value.Issuer,
            ValidAudience = jwtSettings.Value.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSettings.Value.Key))
        };
    });

builder.Services.AddAuthorization();

// Rate limiting configuration
var rateLimitConfig = builder.Configuration.GetSection("RateLimiting");
var rateLimitEnabled = rateLimitConfig.GetValue("Enabled", true);
var permitLimit = rateLimitConfig.GetValue("PermitLimit", 100);
var windowSeconds = rateLimitConfig.GetValue("WindowSeconds", 60);
var queueLimit = rateLimitConfig.GetValue("QueueLimit", 10);

if (rateLimitEnabled)
{
    builder.Services.AddRateLimiter(options =>
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

        options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        {
            var endpoint = context.GetEndpoint();

            // Auth endpoints get stricter limits to prevent brute-force attacks.
            var isAuthEndpoint = endpoint?.Metadata
                .GetMetadata<AuthorizeAttribute>() is null &&
                context.Request.Path.StartsWithSegments("/api/v1/auth");

            var permit = isAuthEndpoint ? 10 : permitLimit;
            var window = isAuthEndpoint ? TimeSpan.FromMinutes(1) : TimeSpan.FromSeconds(windowSeconds);

            // Use IP address as partition key for rate limiting.
            var partitionKey = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

            return RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: partitionKey,
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = permit,
                    Window = window,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = queueLimit
                });
        });
    });
}

const string CorsPolicy = "Frontend";
builder.Services.AddCors(options =>
    options.AddPolicy(CorsPolicy, policy =>
        policy
            .WithOrigins(
                builder.Configuration
                    .GetSection("Cors:AllowedOrigins")
                    .Get<string[]>() ?? [])
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()));

builder.Services.AddSignalR();
builder.Services.AddSingleton<IRealtimeNotifier, SignalRProjectNotifier>();
builder.Services.AddSingleton<INotificationBroadcaster, NotificationBroadcaster>();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IUserContext, UserContext>();

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Version = "v1",
        Title = "DevFlow API",
        Description = "A project management platform for developers. Plan sprints, manage tasks on a Kanban board, and ship faster.",
        Contact = new OpenApiContact
        {
            Name = "DevFlow",
            Url = new Uri("https://github.com/chi-trung/devflow-platform")
        },
        License = new OpenApiLicense
        {
            Name = "MIT"
        }
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter your JWT access token."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddHealthChecks()
    .AddNpgSql(
        builder.Configuration.GetConnectionString("Database")!,
        name: "postgresql",
        tags: ["ready"]);

// Redis is optional: only registered (and only part of readiness) when a
// connection string is configured, so production can run without it.
var redisConnection = builder.Configuration.GetConnectionString("Redis");
if (!string.IsNullOrWhiteSpace(redisConnection))
{
    builder.Services.AddHealthChecks()
        .AddRedis(redisConnection, name: "redis", tags: ["redis"]);
}

var app = builder.Build();

// Apply pending EF Core migrations so a fresh database (e.g. a managed
// cloud instance) is ready on first boot.
using (var scope = app.Services.CreateScope())
{
    var database = scope.ServiceProvider
        .GetRequiredService<DevFlow.Infrastructure.Persistence.DevFlowDbContext>();
    database.Database.Migrate();
}

app.UseMiddleware<GlobalExceptionHandlingMiddleware>();

app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors(CorsPolicy);

if (rateLimitEnabled)
{
    app.UseRateLimiter();
}

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

app.MapHub<ProjectHub>("/hubs/projects");
app.MapHub<NotificationHub>("/hubs/notifications");

app.MapHealthChecks("/health", new HealthCheckOptions
{
    // Readiness is gated on the database only; optional services like
    // Redis report under their own tags.
    Predicate = check => check.Tags.Contains("ready")
});

app.Run();

public partial class Program { }
