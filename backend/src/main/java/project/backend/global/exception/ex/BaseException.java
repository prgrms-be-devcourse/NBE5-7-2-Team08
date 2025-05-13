package project.backend.global.exception.ex;

import lombok.Getter;
import org.springframework.http.HttpStatus;
import project.backend.global.exception.errorcode.ErrorCode;

@Getter
public abstract class BaseException extends RuntimeException {

    private final ErrorCode errorCode;

    public BaseException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public HttpStatus getStatus() {
        return errorCode.getStatus();
    }
}
