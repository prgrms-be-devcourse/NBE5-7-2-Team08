package project.backend.global.exception;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import project.backend.global.exception.ex.AuthException;
import project.backend.global.exception.ex.BaseException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BaseException.class)
    public ResponseEntity<?> handleBaseException(BaseException ex) {
        ErrorResponse response = ErrorResponse.toResponse(ex.getErrorCode());

        return ResponseEntity
                .status(ex.getStatus())
                .body(response);

    }

    @ExceptionHandler(AuthException.class)
    public ResponseEntity<ErrorResponse> handleAuthException(AuthException ex) {
        Map<String, Object> details = Map.of(
            "roomId", ex.getRoomId(),
            "inviteCode", ex.getInviteCode()
        );

        ErrorResponse response = ErrorResponse.toResponse(ex.getErrorCode(), details);
        return ResponseEntity.status(ex.getStatus()).body(response);
    }
}
