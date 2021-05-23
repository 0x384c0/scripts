FREQ_MHZ=15.432
#AM with Up Converter
rtl_fm -f $(echo $FREQ_MHZ + 125 | bc)M -M am -s 10k | ffplay -f s16le -channels 1 -sample_rate 10k  -nodisp -i -
#FM
#rtl_fm -f "$FREQ_MHZ"M                  -M fm -s 100k | ffplay -f s16le -channels 1 -sample_rate 100k -nodisp -i -