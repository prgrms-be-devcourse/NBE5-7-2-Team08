package project.backend.global.config.security.app;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.nimbusds.oauth2.sdk.token.TokenEncoding;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.backend.global.config.security.dto.OAuthMemberDto;
import project.backend.global.config.security.jwt.Token;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;


@Slf4j
@Component
@RequiredArgsConstructor
public class JwtProvider {

    public static final Long TOKEN_VALIDATION_SECOND = 600L;
    public static final Long REFRESH_TOKEN_VALIDATION_SECOND = 7 * 24 * 60 * 60L;

    @Value("${jwt.info.secret}")
    private String SECRET_KEY;

    @Value("${jwt.info.issuer}")
    private String ISSUER;

    private Algorithm getSignatureAlgorithm(String secretKet) {
        return Algorithm.HMAC256(secretKet);
    }

    public Token generateTokenPair(OAuthMemberDto oAuthMemberDto) {
        Map<String, String> payload = Map.of(
                "email", oAuthMemberDto.email(),
                "nickname", oAuthMemberDto.name()
        );

        String accessToken = generateAccessToken(payload);
        String refreshToken = generateRefreshToken(payload);

        return new Token(accessToken, refreshToken);
    }

    public String generateAccessToken(Map<String, String> payload) {
        return doGenerateToken(TOKEN_VALIDATION_SECOND, payload);
    }

    public String generateRefreshToken(Map<String, String> payload) {
        return doGenerateToken(REFRESH_TOKEN_VALIDATION_SECOND, payload);
    }

    private JWTVerifier getJwtVerifier() {
        return JWT.require(getSignatureAlgorithm(SECRET_KEY))
                .withIssuer(ISSUER)
                .build();
    }


    //추후 커스텀예외 추가 예정
    public boolean validateToken(String token) {
        try {
            getJwtVerifier().verify(token); // 검증 성공 → 아무 문제 없음
            return true;

        } catch (JWTVerificationException e) {
            log.error("JWT 검증 실패: {}", e.getMessage());
            return false;

        } catch (Exception e) {
            log.error("모루겠음 나가셈 ㅋㅋ");
            return false;
        }
    }


    private String doGenerateToken(Long expiration, Map<String, String> payload) {
        long now = System.currentTimeMillis();

        return JWT.create()
                .withIssuedAt(new Date(now))
                .withExpiresAt(new Date(now + expiration * 1000))
                .withPayload(payload)
                .withIssuer(ISSUER)
                .sign(getSignatureAlgorithm(SECRET_KEY));
    }

}
