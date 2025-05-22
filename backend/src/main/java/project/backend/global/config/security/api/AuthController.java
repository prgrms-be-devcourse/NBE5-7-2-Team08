package project.backend.global.config.security.api;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import project.backend.global.config.security.app.CookieUtils;
import project.backend.global.config.security.app.JwtProvider;

@Slf4j
@RestController
@RequiredArgsConstructor
public class AuthController {

	private final JwtProvider jwtProvider;

	@GetMapping("/auth")
	public void validateToken(HttpServletRequest request, HttpServletResponse response) {
		jwtProvider.validateAuthentication(request, response);
	}


}
