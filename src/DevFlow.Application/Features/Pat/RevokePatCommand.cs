using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Pat;

public sealed record RevokePatCommand(Guid UserId, Guid TokenId) : IRequest;

public sealed class RevokePatCommandHandler(
    IPersonalAccessTokenRepository patRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<RevokePatCommand>
{
    public async Task Handle(RevokePatCommand command, CancellationToken cancellationToken)
    {
        var tokens = await patRepository.GetActiveByUserIdAsync(command.UserId, cancellationToken);

        if (tokens.All(token => token.Id != command.TokenId))
        {
            return;
        }

        await patRepository.RevokeAsync(command.TokenId, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}