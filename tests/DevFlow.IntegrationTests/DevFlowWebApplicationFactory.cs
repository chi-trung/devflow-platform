using DevFlow.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace DevFlow.IntegrationTests;

public sealed class DevFlowWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly PostgreSqlContainer? dbContainer;
    private readonly string? externalConnectionString;

    public static bool IsDockerAvailable { get; private set; } = true;

    public DevFlowWebApplicationFactory()
    {
        // Prefer an externally-provided connection string (CI service container)
        externalConnectionString = Environment.GetEnvironmentVariable("DATABASE_URL");

        if (!string.IsNullOrWhiteSpace(externalConnectionString))
        {
            // CI provides real Postgres — no need for Testcontainers
            IsDockerAvailable = true;
            return;
        }

        try
        {
            dbContainer = new PostgreSqlBuilder()
                .WithImage("postgres:17-alpine")
                .Build();
            dbContainer.StartAsync().GetAwaiter().GetResult();
        }
        catch
        {
            IsDockerAvailable = false;
        }
    }

    public override async ValueTask DisposeAsync()
    {
        if (dbContainer is not null)
        {
            try
            {
                await dbContainer.StopAsync();
            }
            catch
            {
                // ignore
            }
        }
        await base.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureAppConfiguration((context, config) =>
        {
            var settings = new Dictionary<string, string?>
            {
                ["ConnectionStrings:Redis"] = string.Empty,
                ["Jwt:Key"] = "SuperSecretIntegrationTestKeyWithSufficientLength1234567890",
                ["Jwt:Issuer"] = "devflow-api",
                ["Jwt:Audience"] = "devflow-client",
                ["RateLimiting:Enabled"] = "false"
            };

            // Resolve the connection string: env var > Testcontainers > null (InMemory fallback)
            var connectionString = externalConnectionString
                ?? (IsDockerAvailable && dbContainer is not null ? dbContainer.GetConnectionString() : null);

            if (connectionString is not null)
            {
                settings["ConnectionStrings:Database"] = connectionString;
            }

            config.AddInMemoryCollection(settings);
        });

        builder.ConfigureServices(services =>
        {
            if (externalConnectionString is null && !IsDockerAvailable)
            {
                var descriptor = services.SingleOrDefault(
                    d => d.ServiceType == typeof(DbContextOptions<DevFlowDbContext>));

                if (descriptor is not null)
                {
                    services.Remove(descriptor);
                }

                services.AddDbContext<DevFlowDbContext>(options =>
                    options.UseInMemoryDatabase("DevFlowIntegrationTestsDb"));
            }
        });
    }
}
