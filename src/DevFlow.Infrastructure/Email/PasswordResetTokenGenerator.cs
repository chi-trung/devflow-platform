using System.Security.Cryptography;
using DevFlow.Application.Common.Interfaces;

namespace DevFlow.Infrastructure.Email;

/// <summary>
/// Produces 384 bits from the OS CSPRNG and renders them as prefixed hex.
///
/// The "dfpr_" prefix is not security — it exists so the token is
/// self-identifying. A string that turns up in a log, a support ticket or a
/// proxy body can be recognised as a DevFlow reset token and not pasted
/// somewhere it would be mistaken for a session token.
/// </summary>
public sealed class PasswordResetTokenGenerator : IPasswordResetTokenGenerator
{
    private const int TokenByteLength = 48;

    public string Generate()
    {
        var bytes = new byte[TokenByteLength];
        RandomNumberGenerator.Fill(bytes);
        return "dfpr_" + Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
