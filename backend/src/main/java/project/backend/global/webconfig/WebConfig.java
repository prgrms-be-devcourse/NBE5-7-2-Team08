package project.backend.global.webconfig;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

	@Value("${url.front-url}")
	private String frontUrl;

	@Value("${url.s3-url}")
	private String s3Url;

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/**") // 모든 경로 허용
			.allowedOrigins(frontUrl, s3Url) // React dev server
			.allowedMethods("*")
			.allowedHeaders("*")
			.allowCredentials(true);
	}

}

