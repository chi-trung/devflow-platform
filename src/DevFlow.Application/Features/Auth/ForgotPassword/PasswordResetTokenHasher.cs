using System.Security.Cryptography;
using System.Text;

namespace DevFlow.Application.Features.Auth.ForgotPassword;

/// <summary>
/// The one place a reset token becomes a stored value.
///
/// Both the issuing path and the redeeming path must agree exactly, so they
/// share this rather than each rolling their own. Plain SHA-256 is correct
/// here and would be wrong for a password: the input is 384 bits of
/// <see cref="RandomNumberGenerator"/> output, so there is no dictionary to
/// search, and bcrypt's per-hash salt would be pointless work on 30 minutes of
/// exposure.
/// </summary>
public static class PasswordResetTokenHasher
{
    public static string Hash(string token)
    {
        var bytes = Encoding.UTF8.GetBytes(token);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
