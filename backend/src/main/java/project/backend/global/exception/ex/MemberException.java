package project.backend.global.exception.ex;

import project.backend.global.exception.errorcode.MemberErrorCode;

public class MemberException extends BaseException {

    public MemberException(MemberErrorCode errorCode) {
        super(errorCode);
    }
}
