package project.backend.global.exception;

import project.backend.global.exception.errorcode.ChatErrorCode;

public class ChatException extends RuntimeException {

    private final ChatErrorCode errorCode;

    public ChatException(ChatErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}
