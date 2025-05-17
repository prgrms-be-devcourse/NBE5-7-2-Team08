package project.backend.global.config.security.handler;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.HashMap;
import java.util.Optional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;
import project.backend.domain.member.dao.MemberRepository;
import project.backend.domain.member.entity.Member;
import project.backend.global.config.security.app.OAuthSignUpService;
import project.backend.global.config.security.dto.OAuthMemberDto;
import project.backend.global.config.security.app.JwtProvider;
import project.backend.global.config.security.jwt.Token;
import project.backend.global.config.security.redis.entity.TokenRedis;
import project.backend.global.config.security.redis.dao.TokenRedisRepository;

@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    @Value("${jwt.redirection.base}")
    private String baseUrl;

    private final JwtProvider jwtProvider;
    private final OAuthSignUpService oAuthSignUpService;
    private final MemberRepository memberRepository;
    private final TokenRedisRepository tokenRedisRepository;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {

        var oAuth2User = (OAuth2User) authentication.getPrincipal();

        log.info("oAuth2User = {}", oAuth2User);

        OAuthMemberDto userDto = new OAuthMemberDto(
                (String) oAuth2User.getAttributes().get("name"),
                (String) oAuth2User.getAttributes().get("email"));

        Optional<Member> memberOptional = memberRepository.findByEmail(userDto.email());

        Member member = oAuthSignUpService.OAuthSignUp(userDto);

        Token token = jwtProvider.generateTokenPair(userDto);


        tokenRedisRepository.save(new TokenRedis(member.getId(), token.accessToken(), token.refreshToken()));

        HashMap<String, String> params = new HashMap<>();
        params.put("access", token.accessToken());
        params.put("refresh", token.refreshToken());

        log.info("OAuth 로그인 성공");
        log.info("AccessToken = {}", token.accessToken());
        log.info("Refresh Token = {}", token.refreshToken());

        String redirectUrl = genRedirectUrl(params);
        log.info("OAuth 로그인 후 리다이렉트 URL = {}", redirectUrl);

        response.sendRedirect(redirectUrl);

    }

    private String genRedirectUrl(HashMap<String, String> params) {
        return UriComponentsBuilder.fromUriString(baseUrl)
                .queryParam("access", params.get("access"))
                .queryParam("refresh", params.get("refresh"))
                .build().toUriString();
    }
}
