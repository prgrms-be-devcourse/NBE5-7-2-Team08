package project.backend.global.config.security.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.CredentialsExpiredException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;
import project.backend.global.exception.ErrorResponse;
import project.backend.global.exception.errorcode.LoginErrorCode;

import java.io.IOException;

@Slf4j
@Component
public class FormFailureHandler implements AuthenticationFailureHandler {

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
        AuthenticationException exception) throws IOException {

        LoginErrorCode loginErrorCode = getLoginErrorCode(exception);

        response.setStatus(loginErrorCode.getStatus().value());
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        ErrorResponse errorResponse = ErrorResponse.toResponse(loginErrorCode);

        String json = new ObjectMapper().writeValueAsString(errorResponse);
        response.getWriter().write(json);
        response.getWriter().flush();
    }

    private LoginErrorCode getLoginErrorCode(AuthenticationException exception) {
        if (exception instanceof BadCredentialsException
            || exception instanceof InternalAuthenticationServiceException) {
            return LoginErrorCode.BAD_CREDENTIALS;
        } else if (exception instanceof DisabledException) {
            return LoginErrorCode.DISABLED;
        } else if (exception instanceof CredentialsExpiredException) {
            return LoginErrorCode.CREDENTIALS_EXPIRED;
        } else {
            return LoginErrorCode.UNKNOWN;
        }
    }
}
