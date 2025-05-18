package project.backend.global.config.security.handler;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import project.backend.global.config.security.app.CookieUtils;
import project.backend.global.config.security.app.JwtProvider;
import project.backend.global.config.security.jwt.TokenStatus;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private final JwtProvider jwtProvider;

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
		FilterChain filterChain)
		throws ServletException, IOException {

		Optional<Cookie> accessToken = CookieUtils.getCookie((HttpServletRequest) request,
			"accessToken");

		if (accessToken.isPresent()) {
			String token = accessToken.get().getValue();

			TokenStatus tokenStatus = jwtProvider.validateAccessToken(token);

			switch (tokenStatus) {
				case VALID -> {
					log.info("Validating access token");
					Authentication authentication = jwtProvider.getAuthentication(token);
					SecurityContextHolder.getContext().setAuthentication(authentication);
				}
				case EXPIRED -> {
					log.info("Expiring access token");
					Authentication authentication = jwtProvider.replaceAccessToken(response, token);
					if (authentication != null) {
						log.info("Successfully expired access token");
						SecurityContextHolder.getContext().setAuthentication(authentication);
					}
				}
				default -> {
					log.warn("JWT 토큰 인증 처리 불가: {}", token);
					log.warn("재로그인 필요");
				}
			}
		}

		filterChain.doFilter(request, response);
	}
}
