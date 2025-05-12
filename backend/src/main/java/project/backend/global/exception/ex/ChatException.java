package project.backend.global.exception.ex;

import project.backend.global.exception.errorcode.ChatErrorCode;

public class ChatException extends BaseException {

    public ChatException(ChatErrorCode errorCode) {
        super(errorCode);
    }
}
