package project.backend.domain.imagefile;


import com.amazonaws.services.s3.AmazonS3;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import project.backend.global.exception.ex.ImageFileException;
import project.backend.global.exception.errorcode.ImageFileErrorCode;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImageFileService {

	private final ImageFileRepository imageFileRepository;

	private final AmazonS3 amazonS3;

	@Value("${cloud.aws.s3.bucket}")
	private String bucket;


	@Transactional
	public ImageFile saveImageFile(MultipartFile file, ImageType type) {

		log.info("Saving profile image file");
		String uploadFileName = file.getOriginalFilename();

		checkExtension(uploadFileName);
		checkFileTypeIsImage(file.getContentType());

		String extension = uploadFileName.substring(uploadFileName.lastIndexOf(".")).toLowerCase();

		checkFileExtensionIsImage(extension);

		String storeFileName = UUID.randomUUID() + extension;

		Path savePath;
		if (type.equals(ImageType.PROFILE_IMAGE)) {
			savePath = Paths.get(profilePath, storeFileName);
		} else if (type.equals(ImageType.CHAT_IMAGE)) {
			savePath = Paths.get(chatImagePath, storeFileName);
		} else {
			throw new ImageFileException(ImageFileErrorCode.INVALID_ROUTE);
		}

		ImageFile imageFile = ImageFile.ofProfile(storeFileName, uploadFileName);
		imageFileRepository.saveAndFlush(imageFile);
		log.info("Saved Metadata of profile image file");

		try {
			log.info("📁 저장 경로: {}", savePath.toAbsolutePath());
			file.transferTo(savePath);
			return imageFile;

		} catch (IOException e) {
			imageFileRepository.delete(imageFile);
			log.error("파일 저장 중 IOException 발생", e);
			throw new ImageFileException(ImageFileErrorCode.FILE_SAVE_FAILURE);
		}
	}


	private void checkFileExtensionIsImage(String extension) {
		List<String> imageExtensions = List.of(".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp");
		if (!imageExtensions.contains(extension)) {
			throw new ImageFileException(ImageFileErrorCode.INVALID_IMAGE_TYPE);
		}
	}

	private void checkFileTypeIsImage(String fileType) {
		if (fileType == null || !fileType.startsWith("image/")) {
			throw new ImageFileException(ImageFileErrorCode.INVALID_IMAGE_TYPE);
		}
	}

	private void checkExtension(String fileName) {
		if (fileName == null || !fileName.contains(".")) {
			throw new ImageFileException(ImageFileErrorCode.INVALID_IMAGE_TYPE);
		}
	}

	@Transactional(readOnly = true)
	public ImageFile getProfileImageByStoreFileName(String storeFileName) {
		return imageFileRepository.findByStoreFileName(storeFileName)
			.orElseThrow(() -> new ImageFileException(ImageFileErrorCode.FILE_NOT_FOUND));
	}

	@Transactional(readOnly = true)
	public ImageFile getImageById(Long imageFileId) {
		return imageFileRepository.findById(imageFileId)
			.orElseThrow(() -> new ImageFileException(ImageFileErrorCode.FILE_NOT_FOUND));
	}
}
