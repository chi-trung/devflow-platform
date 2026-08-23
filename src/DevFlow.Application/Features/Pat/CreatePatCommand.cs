using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Pat;

public sealed record CreatePatCommand(
    Guid UserId,
    string Name,
    IReadOnlyList<string> Scopes,
    DateTimeOffset? ExpiresAtUtc) : IRequest<PatCreatedResponse>;

public sealed class CreatePatCommandHandler(
    IPersonalAccessTokenRepository patRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<CreatePatCommand, PatCreatedResponse>
{
    public async Task<PatCreatedResponse> Handle(
        CreatePatCommand command,
        CancellationToken cancellationToken)
    {
        var rawToken = GenerateTokenString();
        var tokenHash = HashToken(rawToken);

        var token = PersonalAccessToken.Create(
            command.UserId,
            command.Name,
            tokenHash,
            command.Scopes,
            command.ExpiresAtUtc);

        await patRepository.AddAsync(token, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new PatCreatedResponse(token.Id, rawToken);
    }

    private static string GenerateTokenString()
    {
        var bytes = new byte[48];
        System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
        return "df_" + Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string HashToken(string token)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(token);
        var hash = System.Security.Cryptography.SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}