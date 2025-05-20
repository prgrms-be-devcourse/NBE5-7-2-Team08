package project.backend.global.config.security.jwt;

public record Token(
        String accessToken,
        String refreshToken
) {

}
