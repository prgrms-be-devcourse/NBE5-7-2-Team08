package project.backend.domain.chat.chatroom.api;

import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import project.backend.domain.chat.chatroom.app.ChatRoomService;
import project.backend.domain.chat.chatroom.dto.ChatRoomRequest;
import project.backend.domain.chat.chatroom.dto.ChatRoomResponse;
import project.backend.domain.chat.chatroom.dto.InviteCodeResponse;

@RestController
@RequestMapping("/api/chat-rooms")
@RequiredArgsConstructor
public class ChatRoomController {

	private final ChatRoomService chatRoomService;

	@PostMapping
	public ChatRoomResponse create(@RequestBody ChatRoomRequest request) {
		return chatRoomService.createChatRoom(request, request.getOwnerId());
	}

	@GetMapping("/{roomId}/invite")
	public InviteCodeResponse getInviteUrl(@PathVariable Long roomId) {
		String inviteCode = chatRoomService.getInviteCode(roomId);

		String inviteUrl = ServletUriComponentsBuilder
			.fromCurrentContextPath()
			.path("/api/chat-rooms/join")
			.path(inviteCode)
			.toUriString();

		return new InviteCodeResponse(inviteUrl);
	}

}
