FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY Directory.Build.props ./
COPY DevFlow.sln ./
COPY src/DevFlow.Domain/DevFlow.Domain.csproj src/DevFlow.Domain/
COPY src/DevFlow.Application/DevFlow.Application.csproj src/DevFlow.Application/
COPY src/DevFlow.Infrastructure/DevFlow.Infrastructure.csproj src/DevFlow.Infrastructure/
COPY src/DevFlow.Api/DevFlow.Api.csproj src/DevFlow.Api/
COPY tests/DevFlow.UnitTests/DevFlow.UnitTests.csproj tests/DevFlow.UnitTests/
COPY tests/DevFlow.IntegrationTests/DevFlow.IntegrationTests.csproj tests/DevFlow.IntegrationTests/
RUN dotnet restore

COPY src/ src/
RUN dotnet publish src/DevFlow.Api -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

EXPOSE 8080

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "DevFlow.Api.dll"]
