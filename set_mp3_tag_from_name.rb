Dir.foreach('./') do |file|
	if file.include? ".mp3"
		author = file.split(" - ").first
		title = file.split(" - ").last.sub(".mp3", "")
		album = author
		puts "id3tag -A \"#{album}\" -a \"#{author}\" -s \"#{title}\" \"#{file}\""
		puts %x( id3tag -A "#{album}" -a "#{author}" -s "#{title}" "#{file}" )
		puts "------------"
	end
end