package project.backend.domain.chat.chatroom.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;


import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import project.backend.domain.chat.chatroom.app.ChatRoomService;
import project.backend.domain.chat.chatroom.dto.ChatRoomRequest;
import project.backend.domain.chat.chatroom.dto.ChatRoomResponse2;
import project.backend.domain.chat.chatroom.dto.InviteCodeResponse;
import project.backend.domain.chat.chatroom.dto.InviteJoinRequest;
import project.backend.domain.chat.chatroom.dto.InviteJoinResponse;


@Slf4j
@RestController
@RequestMapping("/chat-rooms")
@RequiredArgsConstructor
public class ChatRoomController {

	private final ChatRoomService chatRoomService;

	@PostMapping
	@ResponseBody
	@ResponseStatus(HttpStatus.CREATED)
	public ChatRoomResponse2 createChatRoom(@Valid @RequestBody ChatRoomRequest request) {
	//	Long ownerId = memberDetails.getId();

		Long ownerId = 2L;
		log.info("채팅방생성");
		return chatRoomService.createChatRoom(request, ownerId);
	}

	@GetMapping("/invite/{roomId}")
	@ResponseBody
	public InviteCodeResponse getInviteUrl(@PathVariable Long roomId
		//@AuthenticationPrincipal MemberDetails memberDetails
	) {

//		if (memberDetails == null) {
//			throw new AccessDeniedException("로그인한 사용자만 초대 URL을 복사할 수 있습니다.");
//		}

	//	Long memberId = memberDetails.getId();
		boolean isParticipant = chatRoomService.isParticipant(roomId, 2L);

		if (!isParticipant) {
			throw new AccessDeniedException("해당 채팅방에 참여 중인 사용자만 초대 URL을 복사할 수 있습니다.");
		}

		String inviteCode = chatRoomService.getInviteCode(roomId);

//		String inviteUrl = UriComponentsBuilder
//			.fromUriString("http://localhost:3000")
//			.path("/chat/{roomId}")
//			.queryParam("inviteCode", inviteCode)
//			.buildAndExpand(roomId)
//			.toUriString();

		return new InviteCodeResponse(inviteCode);
	}


	@PostMapping("/join")
	@ResponseStatus(HttpStatus.OK)
	public InviteJoinResponse joinChatRoom(@RequestBody InviteJoinRequest request
	//	@AuthenticationPrincipal MemberDetails memberDetails
	) {
//		if (memberDetails == null) {
//			throw new AccessDeniedException("로그인한 사용자만 입장할 수 있습니다.");
//		}

		Long tempId = 3L;
		Long roomId = chatRoomService.joinChatRoom(request.getInviteCode(), tempId);
		return new InviteJoinResponse(roomId);
	}


}
