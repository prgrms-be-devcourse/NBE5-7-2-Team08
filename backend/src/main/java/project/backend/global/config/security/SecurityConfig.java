package project.backend.global.config.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import project.backend.global.config.security.app.CustomOAuth2UserService;
import project.backend.global.config.security.handler.CustomLogoutSuccessHandler;
import project.backend.global.config.security.handler.FormFailureHandler;
import project.backend.global.config.security.handler.FormSuccessHandler;
import project.backend.global.config.security.handler.OAuth2FailureHandler;
import project.backend.global.config.security.handler.OAuth2SuccessHandler;
import project.backend.global.config.security.handler.RestAuthenticationEntryPoint;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

	private final FormFailureHandler formFailureHandler;
	private final FormSuccessHandler formSuccessHandler;

	private final OAuth2SuccessHandler oAuth2SuccessHandler;
	private final OAuth2FailureHandler oAuth2FailureHandler;
	private final CustomOAuth2UserService oAuth2UserService;

	private final CustomLogoutSuccessHandler logoutSuccessHandler;
	private final RestAuthenticationEntryPoint restAuthenticationEntryPoint;

	@Bean
	public PasswordEncoder passwordEncoder() {
		return PasswordEncoderFactories.createDelegatingPasswordEncoder();
	}

	@Bean
	public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		return http
			.httpBasic(AbstractHttpConfigurer::disable)
			.csrf(AbstractHttpConfigurer::disable)
			.cors(Customizer.withDefaults())
//            .sessionManagement(
//                session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
//
			.formLogin(form -> {
				form.loginPage("/login")
					.usernameParameter("email")
					.passwordParameter("password")
					.failureHandler(formFailureHandler)
					.successHandler(formSuccessHandler)
					.permitAll();
			})

			.authorizeHttpRequests(auth -> {
				auth
					.requestMatchers("/signup", "/login", "/", "/login/oauth2/**", "/error")
					.anonymous()

					.requestMatchers("/token/**")
					.permitAll()

					.anyRequest()
					.authenticated();
			})

			.oauth2Login(oauth -> {
				oauth.successHandler(oAuth2SuccessHandler);
				oauth.failureHandler(oAuth2FailureHandler);
				oauth.userInfoEndpoint(userInfoEndpoint -> {
					userInfoEndpoint.userService(oAuth2UserService);
				});
			})

			.logout(logout -> logout
				.logoutUrl("/logout")
				.logoutSuccessHandler(logoutSuccessHandler)
				.invalidateHttpSession(true)
				.deleteCookies("JSESSIONID")
			)

			.exceptionHandling(exception ->
				exception.authenticationEntryPoint(restAuthenticationEntryPoint))
//
//            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
			.build();
	}
}
