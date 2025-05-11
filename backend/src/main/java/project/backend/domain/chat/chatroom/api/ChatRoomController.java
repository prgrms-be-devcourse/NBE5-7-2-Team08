package project.backend.domain.chat.chatroom.api;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import project.backend.domain.chat.chatroom.app.ChatRoomService;
import project.backend.domain.chat.chatroom.dto.ChatRoomRequest;
import project.backend.domain.chat.chatroom.dto.ChatRoomResponse;

@RestController
@RequestMapping("/api/chat-rooms")
@RequiredArgsConstructor
public class ChatRoomController {

	private final ChatRoomService chatRoomService;

	@PostMapping
	public ChatRoomResponse create(@RequestBody ChatRoomRequest request) {

		ChatRoomResponse response = chatRoomService.createChatRoom(request, request.getOwnerId());

		return response;
	}

}
