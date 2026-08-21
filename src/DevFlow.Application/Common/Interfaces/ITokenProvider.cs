namespace DevFlow.Application.Common.Interfaces;

public interface ITokenProvider
{
    string GenerateAccessToken(Domain.Entities.User user);

    string GenerateRefreshToken();
}
