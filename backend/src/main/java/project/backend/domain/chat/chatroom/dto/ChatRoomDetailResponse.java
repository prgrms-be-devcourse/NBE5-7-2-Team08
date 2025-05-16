package project.backend.domain.chat.chatroom.dto;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
//강현님꺼
public class ChatRoomDetailResponse {

	private String roomName;

	private Long ownerId;

	private int participantCount;

	private String repositoryUrl;

	private List<ChatParticipantResponse> participants;
}


