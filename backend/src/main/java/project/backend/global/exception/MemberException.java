package project.backend.global.exception;

import lombok.Getter;
import project.backend.global.exception.errorcode.MemberErrorCode;

@Getter
public class MemberException extends RuntimeException {

    private final MemberErrorCode errorCode;

    public MemberException(MemberErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

}
