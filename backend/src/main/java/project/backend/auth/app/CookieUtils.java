package project.backend.auth.app;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Arrays;
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
			.maxAge(60 * 60 * 24 * 7)
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
		if (cookies == null) {
			return Optional.empty();
		}

		return Arrays.stream(cookies)
			.filter(c -> c.getName().equals(name))
			.findFirst();
	}

}
