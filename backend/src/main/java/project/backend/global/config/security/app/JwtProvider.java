package project.backend.global.config.security.app;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTDecodeException;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.exceptions.SignatureVerificationException;
import com.auth0.jwt.exceptions.TokenExpiredException;
import com.nimbusds.oauth2.sdk.token.TokenEncoding;
import io.lettuce.core.RedisException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.catalina.mapper.Mapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.backend.domain.member.app.MemberService;
import project.backend.domain.member.dao.MemberRepository;
import project.backend.domain.member.entity.Member;
import project.backend.domain.member.mapper.MemberMapper;
import project.backend.global.config.security.dto.MemberDetails;
import project.backend.global.config.security.dto.OAuthMemberDto;
import project.backend.global.config.security.jwt.Token;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import project.backend.global.config.security.jwt.TokenStatus;
import project.backend.global.config.security.redis.dao.TokenRedisRepository;
import project.backend.global.config.security.redis.entity.TokenRedis;
import project.backend.global.exception.errorcode.TokenErrorCode;
import project.backend.global.exception.ex.TokenException;


@Slf4j
@Component
@RequiredArgsConstructor
public class JwtProvider {

	public static final Long TOKEN_VALIDATION_SECOND = 10L;
	public static final Long REFRESH_TOKEN_VALIDATION_SECOND = 7 * 24 * 60 * 60L;

	private final TokenRedisRepository tokenRedisRepository;
	private final MemberRepository memberRepository;

	@Value("${jwt.info.secret}")
	private String SECRET_KEY;

	@Value("${jwt.info.issuer}")
	private String ISSUER;

	private Algorithm getSignatureAlgorithm(String secretKey) {
		return Algorithm.HMAC256(secretKey);
	}

	public Token generateTokenPair(OAuthMemberDto oAuthMemberDto) {
		Map<String, String> payload = Map.of(
			"email", oAuthMemberDto.email(),
			"nickname", oAuthMemberDto.nickname()
		);

		String accessToken = generateAccessToken(payload);
		String refreshToken = generateRefreshToken(payload);

		return new Token(accessToken, refreshToken);
	}

	public Token generateTokenPair(MemberDetails memberDetails) {

		Map<String, String> payload = Map.of(
			"email", memberDetails.getEmail(),
			"nickname", memberDetails.getNickname()
		);

		String accessToken = generateAccessToken(payload);
		String refreshToken = generateRefreshToken(payload);

		return new Token(accessToken, refreshToken);
	}

	private String generateAccessToken(Map<String, String> payload) {
		return doGenerateToken(TOKEN_VALIDATION_SECOND, payload);
	}

	private String generateRefreshToken(Map<String, String> payload) {
		return doGenerateToken(REFRESH_TOKEN_VALIDATION_SECOND, payload);
	}

	private String regenerateAccessToken(Authentication authentication) {
		var memberDetails = (MemberDetails) authentication.getPrincipal();
		Map<String, String> payload = Map.of(
			"email", memberDetails.getEmail(),
			"nickname", memberDetails.getNickname()
		);

		return generateAccessToken(payload);
	}


	private JWTVerifier getJwtVerifier(Long expiresSeconds) {
		return JWT.require(getSignatureAlgorithm(SECRET_KEY))
			.withIssuer(ISSUER)
			.acceptExpiresAt(expiresSeconds)
			.build();
	}


	public TokenStatus validateAccessToken(String token) {
		try {
			getJwtVerifier(TOKEN_VALIDATION_SECOND).verify(token);
			return TokenStatus.VALID;

		} catch (TokenExpiredException e) {
			log.warn("JWT 만료됨: {}", e.getMessage());
			return TokenStatus.EXPIRED;

		} catch (SignatureVerificationException e) {
			log.error("서명 오류: {}", e.getMessage());
			return TokenStatus.INVALID_SIGNATURE;

		} catch (JWTDecodeException e) {
			log.error("디코딩 오류: {}", e.getMessage());
			return TokenStatus.MALFORMED;

		} catch (JWTVerificationException e) {
			log.error("기타 검증 오류: {}", e.getMessage());
			return TokenStatus.UNKNOWN_ERROR;

		} catch (Exception e) {
			log.error("예상치 못한 오류: {}", e.getMessage());
			return TokenStatus.UNKNOWN_ERROR;
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

	private String getEmailFromToken(String token) {
		return getJwtVerifier(TOKEN_VALIDATION_SECOND)
			.verify(token)
			.getClaim("email")
			.asString();
	}

	public Authentication getAuthentication(String token) {

		String email = getEmailFromToken(token);

		Member member = memberRepository.findByEmail(email)
			.orElseThrow(
				() -> new UsernameNotFoundException("토큰 email 정보가 적절하지 않습니다.(회원을 찾을 수 없습니다.)"));
		MemberDetails memberDetails = new MemberDetails(member);

		return new UsernamePasswordAuthenticationToken(memberDetails, token,
			memberDetails.getAuthorities());
	}

	public Authentication replaceAccessToken(HttpServletResponse response,
		String token) throws IOException {
		try {
			Optional<TokenRedis> tokenRedisOpt = tokenRedisRepository.findByAccessToken(token);
			if (tokenRedisOpt.isEmpty()) {
				log.warn("토큰 없음: 로그인 페이지로 이동");
				response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
				return null;
			}
			TokenRedis tokenRedis = tokenRedisOpt.get();
			String refreshToken = tokenRedis.getRefreshToken();

			//리프레쉬 토큰 유효성 검사
			JWTVerifier jwtVerifier = getJwtVerifier(REFRESH_TOKEN_VALIDATION_SECOND);
			jwtVerifier.verify(refreshToken);

			log.info("accessToken 재발급 시작 = {}", refreshToken);

			Authentication authentication = getAuthentication(refreshToken);

			// 새로운 액세스 토큰 발급
			String newAccessToken = regenerateAccessToken(authentication);

			CookieUtils.saveCookie(response, newAccessToken);

			tokenRedis.updateAccessToken(newAccessToken);

			tokenRedisRepository.save(tokenRedis);
			log.info("토큰 재발급 완료");

			return authentication;
		} catch (JwtException e) {
			log.error(e.getMessage());
			response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
		} catch (RedisException e) {
			log.error(e.getMessage());
			response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Redis 서버 에러");
		}
		return null;
	}
}
