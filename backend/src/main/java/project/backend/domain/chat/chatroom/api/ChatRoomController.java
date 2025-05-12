package project.backend.domain.chat.chatroom.api;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;


import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import project.backend.domain.chat.chatroom.app.ChatRoomService;
import project.backend.domain.chat.chatroom.dto.ChatRoomRequest;
import project.backend.domain.chat.chatroom.dto.ChatRoomResponse;
import project.backend.domain.chat.chatroom.dto.InviteCodeResponse;
import project.backend.domain.member.dto.MemberDetails;

@Controller
@RequestMapping("/api/chat-rooms")
@RequiredArgsConstructor
public class ChatRoomController {

	private final ChatRoomService chatRoomService;

	@PostMapping
	@ResponseBody
	public ChatRoomResponse createChatRoom(@RequestBody ChatRoomRequest request,
		@AuthenticationPrincipal MemberDetails memberDetails) {
		Long ownerId = memberDetails.getId();
		return chatRoomService.createChatRoom(request, ownerId);
	}

	@GetMapping("/{roomId}/invite")
	@ResponseBody
	public InviteCodeResponse getInviteUrl(@PathVariable Long roomId) {
		String inviteCode = chatRoomService.getInviteCode(roomId);

		String inviteUrl = ServletUriComponentsBuilder
			.fromCurrentContextPath()
			.path("/api/chat-rooms/join/{code}")
			.buildAndExpand(inviteCode)
			.toUriString();

		return new InviteCodeResponse(inviteUrl);
	}

	@GetMapping("/join/{inviteCode}")
	public String handleInviteLink(@PathVariable String inviteCode,
		@AuthenticationPrincipal MemberDetails memberDetails) {

		Long memberId = memberDetails.getId();
		chatRoomService.joinChatRoom(inviteCode, memberId);

		return "redirect:/chat-room/" + inviteCode; //프론트 채팅방 경로로 리다이렉트
	}

}
