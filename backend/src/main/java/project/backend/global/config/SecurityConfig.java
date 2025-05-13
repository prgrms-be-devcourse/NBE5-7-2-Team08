package project.backend.global.config;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

	@Bean
	public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
		http
			.cors()                                 // ← CORS 필터 활성화
			.and()
			.csrf(csrf -> csrf.disable())
			.authorizeHttpRequests(auth -> auth
				// preflight(OPTIONS) 허용
				.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
				// 채팅방 생성만 풀기
				.requestMatchers(HttpMethod.POST, "/chat-rooms").permitAll()
				.requestMatchers(HttpMethod.GET, "/chat-rooms/invite/**").permitAll()
				.requestMatchers(HttpMethod.POST,"/chat-rooms/join").permitAll()
				// 나머지는 인증 필요
				.anyRequest().authenticated()
			)
			.httpBasic(Customizer.withDefaults());
		return http.build();
	}

	@Bean
	public CorsConfigurationSource corsConfigurationSource() {
		CorsConfiguration cfg = new CorsConfiguration();
		cfg.setAllowedOrigins(List.of("http://localhost:3000"));      // 프론트 URL
		cfg.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
		cfg.setAllowedHeaders(List.of("*"));
		cfg.setAllowCredentials(true);

		UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
		src.registerCorsConfiguration("/**", cfg);                   // 모든 경로에 적용
		return src;
	}
}
