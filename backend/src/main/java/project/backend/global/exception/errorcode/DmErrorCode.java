package project.backend.global.exception.errorcode;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum DmErrorCode implements ErrorCode {
	NOT_FOUND_DM_CHAT("DME-001", "DM채팅방을 찾을 수 없습니다. 먼저 친구추가를 해보세요", HttpStatus.NOT_FOUND),
	INVALID_HISTORY_CURSOR("DME-002", "잘못된 요청입니다. 다시 시도해주세요.", HttpStatus.BAD_REQUEST),
	INVALID_HISTORY_SIZE("DME-003", "DM 이력 조회 크기는 1 이상 100 이하여야 합니다.", HttpStatus.BAD_REQUEST);

	private final String code;
	private final String message;
	private final HttpStatus status;
}
