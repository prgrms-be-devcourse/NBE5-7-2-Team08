package project.backend.global.exception;

import lombok.Builder;
import lombok.Getter;
import org.springframework.http.HttpStatus;
import project.backend.global.exception.errorcode.ErrorCode;

@Builder
@Getter
public class ErrorResponse {

    private String code;
    private String message;

    public static ErrorResponse toResponse(ErrorCode errorCode) {
        return ErrorResponse.builder()
            .code(errorCode.getCode())
            .message(errorCode.getMessage())
            .build();
    }

}
