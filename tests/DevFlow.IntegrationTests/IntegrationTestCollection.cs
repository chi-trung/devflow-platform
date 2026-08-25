using Xunit;

namespace DevFlow.IntegrationTests;

/// <summary>
/// All integration tests share a single DevFlowWebApplicationFactory (and
/// therefore one database) so that EF migrations run exactly once. xUnit runs
/// different test classes in parallel by default — two hosts racing to apply
/// migrations on a fresh database collide on shared Postgres catalog entries
/// (pg_type_typname_nsp_index). Disabling parallelization for this collection
/// serializes the classes and the ICollectionFixture reuses one factory.
/// </summary>
[CollectionDefinition("IntegrationTests", DisableParallelization = true)]
public class IntegrationTestCollection : ICollectionFixture<DevFlowWebApplicationFactory>;
