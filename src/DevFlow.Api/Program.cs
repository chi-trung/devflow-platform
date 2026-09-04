using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using System.IdentityModel.Tokens.Jwt;
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
using Microsoft.AspNetCore.HttpOverrides;
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
    .AddAuthentication(options =>
    {
        // Dispatcher: hub-ticket requests authenticate via the one-time
        // ticket handler; everything else keeps the standard bearer flow.
        options.DefaultScheme = "HubOrBearer";
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddPolicyScheme("HubOrBearer", "Hub ticket, PAT, or Bearer", options =>
    {
        options.ForwardDefaultSelector = context =>
            HubTicketAuthenticationHandler.PresentsTicket(context)
                ? HubTicketAuthenticationHandler.SchemeName
                : PatAuthenticationHandler.PresentsPat(context)
                    ? PatAuthenticationHandler.SchemeName
                    : JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer()
    .AddScheme<HubTicketAuthenticationOptions, HubTicketAuthenticationHandler>(
        HubTicketAuthenticationHandler.SchemeName, _ => { })
    .AddScheme<PatAuthenticationOptions, PatAuthenticationHandler>(
        PatAuthenticationHandler.SchemeName, _ => { });

// One-time hub tickets: SignalR WebSockets cannot send an Authorization
// header, so instead of putting the long-lived JWT in the query string
// (which proxies log), the client POSTs /auth/hub-ticket with its bearer
// token and connects with the returned single-use, 90s ticket.
builder.Services.AddSingleton<HubTicketStore>();

// SignalR's default provider reads "nameidentifier"; DevFlow JWTs carry
// "sub" (MapInboundClaims=false), so without this Context.UserIdentifier
// is null and per-user notification groups never match.
builder.Services.AddSingleton<Microsoft.AspNetCore.SignalR.IUserIdProvider, SubUserIdProvider>();

builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtSettings>>((bearer, jwtSettings) =>
    {
        bearer.MapInboundClaims = false;

        // Legacy path kept for one deploy window: hub requests carrying the
        // old "access_token" query parameter still authenticate via JWT.
        // Frontend now sends one-time hub tickets instead ("hub_ticket"),
        // handled by HubTicketAuthenticationHandler.
        bearer.Events = new JwtBearerEvents
        {
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

// Behind reverse proxies (Render, Vercel, nginx) RemoteIpAddress is the
// proxy's address, so forwarded headers must be applied before anything
// that reads the client IP — otherwise all clients share one rate-limit
// partition and trip 429s together.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Accept forwarded headers from any proxy: cloud hosts rotate edge IPs.
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Rate limiting configuration
var rateLimitConfig = builder.Configuration.GetSection("RateLimiting");
var rateLimitEnabled = rateLimitConfig.GetValue("Enabled", true);
var permitLimit = rateLimitConfig.GetValue("PermitLimit", 200);
var authenticatedPermitLimit = rateLimitConfig.GetValue("AuthenticatedPermitLimit", 400);
var windowSeconds = rateLimitConfig.GetValue("WindowSeconds", 60);
var queueLimit = rateLimitConfig.GetValue("QueueLimit", 20);

if (rateLimitEnabled)
{
    builder.Services.AddRateLimiter(options =>
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

        options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        {
            var endpoint = context.GetEndpoint();

            // Realtime hubs negotiate/poll frequently and health probes are
            // automated — counting them against the client quota starves the
            // SPA of API calls.
            if (context.Request.Path.StartsWithSegments("/hubs") ||
                context.Request.Path.StartsWithSegments("/health") ||
                context.Request.Path.StartsWithSegments("/api/v1/ping"))
            {
                return RateLimitPartition.GetNoLimiter<string>("unlimited");
            }

            // Auth endpoints get stricter limits to prevent brute-force attacks.
            var isAuthEndpoint = endpoint?.Metadata
                .GetMetadata<AuthorizeAttribute>() is null &&
                context.Request.Path.StartsWithSegments("/api/v1/auth");

            // Use authenticated user identity as partition key when available,
            // otherwise fall back to IP address. Authenticated users get a
            // higher quota (tiering).
            var user = context.User;
            var isAuthenticated = user?.Identity?.IsAuthenticated == true;
            var partitionKey = isAuthenticated
                ? user!.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown"
                : (context.Connection.RemoteIpAddress?.ToString() ?? "unknown");

            var permit = isAuthEndpoint ? 10 : (isAuthenticated ? authenticatedPermitLimit : permitLimit);
            var window = isAuthEndpoint ? TimeSpan.FromMinutes(1) : TimeSpan.FromSeconds(windowSeconds);

            return RateLimitPartition.GetSlidingWindowLimiter(
                partitionKey: partitionKey,
                factory: _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit = permit,
                    Window = window,
                    SegmentsPerWindow = 4,
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
builder.Services.AddSingleton<IRealtimeNotificationService, SignalRNotificationService>();

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
        Description = "Enter your JWT access token, or a personal access token (df_...)."
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

// Must be the first middleware: it rewrites RemoteIpAddress from
// X-Forwarded-For so rate limiting partitions per real client.
app.UseForwardedHeaders();

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

// PAT scope gate: read-only personal access tokens get 403 on writes.
// Must sit after UseAuthentication (needs the PAT principal's scopes) and
// before UseAuthorization.
app.UseMiddleware<PatScopeMiddleware>();

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
