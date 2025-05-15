package project.backend.global.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import project.backend.global.exception.errorcode.ErrorCode;
import project.backend.global.exception.errorcode.MemberInputInvalidErrorCode;
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

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleMethodArgumentNotValidException(MethodArgumentNotValidException ex) {
        FieldError fieldError = ex.getBindingResult().getFieldError();


        if (fieldError == null) {
            ErrorCode errorCode = MemberInputInvalidErrorCode.INVALID_UNKNOWN;

            return ResponseEntity
                    .status(errorCode.getStatus())
                    .body(ErrorResponse.toResponse(errorCode));
        }

        ErrorCode errorCode = switch (fieldError.getField()) {
            case "email" -> MemberInputInvalidErrorCode.INVALID_EMAIL;
            case "password" -> MemberInputInvalidErrorCode.INVALID_PASSWORD;
            case "nickname" -> MemberInputInvalidErrorCode.INVALID_NICKNAME;
            default -> MemberInputInvalidErrorCode.INVALID_UNKNOWN;
        };

        ErrorResponse response = ErrorResponse.toResponse(errorCode);
        return ResponseEntity
                .status(errorCode.getStatus())
                .body(response);
    }
}
