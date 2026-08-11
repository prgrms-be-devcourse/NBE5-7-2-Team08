package project.backend.domain.dm.dmMessage.dto;

import java.time.LocalDateTime;
import java.util.List;

public record DmMessageHistoryResponse(
	List<DmMessageResponse> content,
	Cursor nextCursor,
	boolean hasNext
) {

	public record Cursor(LocalDateTime sentAt, Long messageId) {
	}
}
