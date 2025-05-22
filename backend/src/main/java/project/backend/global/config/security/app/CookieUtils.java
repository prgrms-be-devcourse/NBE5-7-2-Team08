package project.backend.global.config.security.app;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;

public class CookieUtils {

	public static void saveCookie(HttpServletResponse response, String accessToken) {
		ResponseCookie cookie = ResponseCookie.from("accessToken", accessToken)
			.httpOnly(true)
			.secure(true)
			.sameSite("None")
			.path("/")
			.maxAge(60 * 10)
			.build();

		response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
	}

	public static void deleteCookie(HttpServletResponse response) {
		ResponseCookie cookie = ResponseCookie.from("accessToken", "")
			.httpOnly(true)
			.secure(true)
			.sameSite("None")
			.path("/")
			.maxAge(0)
			.build();

		response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
	}

	public static Optional<Cookie> getCookie(HttpServletRequest request, String name) {
		Cookie[] cookies = request.getCookies();
		if (cookies != null && cookies.length > 0) {
			for (Cookie cookie : cookies) {
				if (cookie.getName().equals(name)) {
					return Optional.of(cookie);
				}
			}
		}
		return Optional.empty();
	}

}
