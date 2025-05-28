package project.backend.global.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

	@Value("${url.front-url}")
	private String frontUrl;

	@Value("${url.s3-url}")
	private String s3Url;

	@Value("${file.images.chat.path}")
	private String fileUploadPath;

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/**") // 모든 경로 허용
			.allowedOrigins(frontUrl, s3Url) // React dev server
			.allowedMethods("*")
			.allowedHeaders("*")
			.allowCredentials(true);
	}

	@Override
	public void addResourceHandlers(ResourceHandlerRegistry registry) {
		registry
			.addResourceHandler("images/**") // 클라이언트 요청 URL
			.addResourceLocations("file:" + fileUploadPath);   // 실제 서버 폴더 경로
	}
}

