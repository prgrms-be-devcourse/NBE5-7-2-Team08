package project.backend.domain.dm.dmMessage.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import project.backend.domain.dm.dmMessage.app.DmMessageService;
import project.backend.domain.dm.dmMessage.dto.DmMessageRequest;
import project.backend.domain.dm.dmMessage.dto.DmMessageHistoryResponse;
import project.backend.domain.dm.dmMessage.dto.DmMessageResponse;

@Tag(name = "Direct Message", description = "DM API")
@Slf4j
@RestController
@RequestMapping("/dm")
@RequiredArgsConstructor
public class DmMessageController {

	private final DmMessageService dmMessageService;

	@MessageMapping("/send/{roomId}")
	public DmMessageResponse sendMessage(@DestinationVariable Long roomId,
		@Payload DmMessageRequest request, Authentication authentication) {
		return dmMessageService.save(roomId, request, authentication);
	}

	@Operation(summary = "DM 채팅 내역 조회")
	@GetMapping("/history/{roomId}")
	public DmMessageHistoryResponse getDmMessages(@PathVariable Long roomId,
		Authentication auth,
		@RequestParam(required = false) LocalDateTime cursorSentAt,
		@RequestParam(required = false) Long cursorId,
		@RequestParam(defaultValue = "20") int size
	) {
		return dmMessageService.getDmMessages(roomId, cursorSentAt, cursorId, size, auth);
	}
}
