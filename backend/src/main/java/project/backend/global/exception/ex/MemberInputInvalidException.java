package project.backend.global.exception.ex;

import project.backend.global.exception.errorcode.ErrorCode;

public class MemberInputInvalidException extends BaseException {
    public MemberInputInvalidException(ErrorCode errorCode) {
        super(errorCode);
    }
}
