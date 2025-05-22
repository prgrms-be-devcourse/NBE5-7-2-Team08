package project.backend.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/**") // 모든 경로 허용
			.allowedOrigins(
				"https://d31jo47k92du0.cloudfront.net",
				"http://flying-truck-react.s3-website.ap-northeast-2.amazonaws.com"
			) // React dev server
			.allowedMethods("*")
			.allowedHeaders("*")
			.allowCredentials(true);
	}

	@Override
	public void addResourceHandlers(ResourceHandlerRegistry registry) {
		registry
			.addResourceHandler("images/**") // 클라이언트 요청 URL
			.addResourceLocations("file:/home/ubuntu/images/");   // 실제 서버 폴더 경로
	}
}

