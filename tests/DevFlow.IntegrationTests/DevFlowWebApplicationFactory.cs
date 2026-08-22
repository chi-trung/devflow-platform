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

    public static bool IsDockerAvailable { get; private set; } = true;

    public DevFlowWebApplicationFactory()
    {
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
        if (IsDockerAvailable && dbContainer is not null)
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

            if (IsDockerAvailable && dbContainer is not null)
            {
                settings["ConnectionStrings:Database"] = dbContainer.GetConnectionString();
            }

            config.AddInMemoryCollection(settings);
        });

        builder.ConfigureServices(services =>
        {
            if (!IsDockerAvailable)
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
