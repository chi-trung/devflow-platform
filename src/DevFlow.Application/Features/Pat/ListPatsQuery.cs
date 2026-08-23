using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Pat;

public sealed record ListPatsQuery(Guid UserId) : IRequest<IReadOnlyList<PatResponse>>;

public sealed class ListPatsQueryHandler(
    IPersonalAccessTokenRepository patRepository) : IRequestHandler<ListPatsQuery, IReadOnlyList<PatResponse>>
{
    public async Task<IReadOnlyList<PatResponse>> Handle(
        ListPatsQuery query,
        CancellationToken cancellationToken)
    {
        var tokens = await patRepository.GetActiveByUserIdAsync(query.UserId, cancellationToken);

        return tokens
            .Select(token => new PatResponse(
                token.Id,
                token.Name,
                token.Scopes,
                token.ExpiresAtUtc,
                token.CreatedAtUtc,
                token.LastUsedAtUtc))
            .ToList();
    }
}