package project.backend.global.exception;

import java.util.Map;
import lombok.Builder;
import lombok.Getter;
import org.springframework.http.HttpStatus;
import project.backend.global.exception.errorcode.ErrorCode;

@Builder
@Getter
public class ErrorResponse {

    private String code;
    private String message;
    private Map<String, Object> details;

    public static ErrorResponse toResponse(ErrorCode errorCode) {
        return ErrorResponse.builder()
            .code(errorCode.getCode())
            .message(errorCode.getMessage())
            .build();
    }

    public static ErrorResponse toResponse(ErrorCode errorCode, Map<String, Object> details) {
        return ErrorResponse.builder()
            .code(errorCode.getCode())
            .message(errorCode.getMessage())
            .details(details)
            .build();
    }
}
