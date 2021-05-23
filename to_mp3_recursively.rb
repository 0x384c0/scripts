%x(mkdir -p trash)
Dir.foreach('./') do |file|
	ext = File.extname file
	fileName = File.basename(file,".*")
	case ext
	when ".ogg" then
		puts %x( ffmpeg -i "#{file}" -ac 2 -b:a 320k  -f mp3 "#{fileName}".mp3 )
		puts %x(mv "#{file}" trash)
	end
end