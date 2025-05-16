package project.backend.domain.chat.chatmessage.api;

import java.security.Principal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import project.backend.domain.chat.chatmessage.app.ChatMessageService;
import project.backend.domain.chat.chatmessage.dto.ChatMessageRequest;
import project.backend.domain.chat.chatmessage.dto.ChatMessageResponse;
import project.backend.domain.chat.chatmessage.dto.ChatMessageSearchRequest;
import project.backend.domain.chat.chatmessage.dto.ChatMessageSearchResponse;

@RestController
@RequiredArgsConstructor
public class ChatMessageController {

	private final ChatMessageService chatMessageService;
	private final SimpMessagingTemplate messagingTemplate;

	@MessageMapping("/send-message/{roomId}") //클라이언트가 메세지를 보낼 경로
	public ChatMessageResponse sendMessage(@DestinationVariable Long roomId,
		@Payload ChatMessageRequest request, Principal principal) {
		ChatMessageResponse response = chatMessageService.save(roomId, request,
			principal.getName());

		messagingTemplate.convertAndSend("/topic/chat/" + roomId, response);

		return response;
	}

	@GetMapping("/chat/search/{roomId}")
	public Page<ChatMessageSearchResponse> searchMessages(
		@PathVariable("roomId") Long roomId,
		@RequestParam("keyword") String keyword,
		@RequestParam(defaultValue = "0") int page,
		@RequestParam(defaultValue = "20") int size
	) {
		ChatMessageSearchRequest request = ChatMessageSearchRequest.of(keyword, page, size);

		return chatMessageService.searchMessages(roomId, request);
	}

	@GetMapping("/{roomId}/messages")
	public List<ChatMessageResponse> getMessages(@PathVariable Long roomId) {
		return chatMessageService.getMessagesByRoomId(roomId);
	}
}
