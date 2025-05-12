package project.backend.global.exception.errorcode;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum ChatErrorCode {

    CHATROOM_NOT_FOUND("CHATROOM_NOT_FOUND", "채팅방을 찾을 수 없습니다.", HttpStatus.NOT_FOUND),
    NOT_PARTICIPANT("NOT_PARTICIPANT", "해당 방에 참여 중인 사용자가 아닙니다.", HttpStatus.FORBIDDEN),
    CHATROOM_NOT_EXIST("CHATROOM_NOT_EXIST", "참여 중인 채팅방이 없습니다.", HttpStatus.NOT_FOUND);

    private final String code;
    private final String message;
    private final HttpStatus status;
}
