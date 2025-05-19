package project.backend.global.config.security.app;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;

public class CookieUtils {

	public static void saveCookie(HttpServletResponse response, String accessToken) {
		Cookie cookie = new Cookie("accessToken", accessToken);
		cookie.setPath("/");
		cookie.setHttpOnly(true);
		cookie.setMaxAge(60 * 10);
		response.addCookie(cookie);
	}

	public static void deleteCookie(HttpServletResponse response) {
		Cookie cookie = new Cookie("accessToken", null);
		cookie.setPath("/");
		cookie.setHttpOnly(true);
		cookie.setMaxAge(0);
		response.addCookie(cookie);
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
