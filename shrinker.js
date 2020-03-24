const fs = require('fs')

if (process.argv.length < 5) {
  console.error('Super file shrinker v1.0.0')
  console.error('    node shrinker.js shrink <input-file> <output-file>')
  console.error('    node shrinker.js unshrink <input-file> <output-file>')
  process.exit(1)
}

let mode = process.argv[2]
let inputFile = process.argv[3]
let outputFile = process.argv[4]

let inputBytes = Array.prototype.slice.call(fs.readFileSync(inputFile))
let outputBytes

if (mode === 'shrink') outputBytes = shrink(inputBytes)
else if (mode === 'unshrink') outputBytes = unshrink(inputBytes)
else throw 'Unknown mode: ' + mode

fs.writeFileSync(outputFile, Buffer.from(outputBytes))

////////// Your code: //////////

function shrink(input) {
  if (!input || input.length < 3) {
    return input
  }
  return runLengthEncode(deltaEncode(input))
}

function unshrink(input) {
  if (!input || input.length < 3) {
    return input
  }
  return deltaDecode(runLengthDecode(input))
}

function runLengthEncode(input) {
  let output = []
  while (input.length > 0) {
    if (input.length > 2 && input[0] === input[1]) {
      let count = 0
      for (let i = 0; i < input.length && input[i] === input[0]; i++) {
        count++
      }
      // 0x00 is used as the tag to indicate reoccurance of a byte
      output.push(0)

      if (count < 255) {
        // a total of 5 bytes are created in this case.
        // 0x00 followed by 0x01 means reoccurences lt 255 as special consideration is needed for
        // reaccurences gt 255. Read comments below
        output.push(count)
        output.push(input[0])
      } else {
        // a total of 5 bytes are created in this case.
        // 0x00 followed by 0x01 means reoccurence of gt 255 because it can potentially create errors
        // as the byte representing the count can overflow. For example: count of 300 =>(encode) 0x2D =>(decode) 45
        // Also, 0x00 followed by 0x01 cannot be cannot define reacurrence of 1 as reacurrence by definition is gt 1
        output.push(1)

        // The byte following 0x01 represents the multiples of 255 reocurrences
        // For example, count of 510 will produce 0x00 => 0x01 => 0x02(multiple of 2)
        output.push(Math.floor(count / 255))

        // The 4th byte created is the remainder after calculating the multiples of 255 reocurrences
        const remainderCount = count % 255
        output.push(remainderCount)

        // Finally, the value that reoccures
        output.push(input[0])
      }

      input = input.slice(count)
    } else {
      if (input[0] === 0) {
        // If a single 0x00 is found, push 2 of them as a single 0x00
        //  is used for the tag
        output.push(0)
      }
      output.push(input[0])

      input = input.slice(1)
    }
  }

  return output
}

function runLengthDecode(input) {
  output = []
  while (input.length > 0) {
    // Check for 0x00 to detect reocurrences
    if (input[0] === 0) {
      // 0x00 followed by 0x00 produces a singular 0x00
      if (input[1] === 0) {
        output.push(0)
        input = input.slice(2)
      } else {
        // If 0x01 follows 0x00 then there are gt 255 reocurrences
        if (input[1] === 1) {
          for (let i = 0; i < input[2] * 255 + input[3]; i++) {
            output.push(input[4])
          }
          input = input.slice(5)
        } else {
          // Reocurrences lt 255
          for (let i = 0; i < input[1]; i++) {
            output.push(input[2])
          }

          input = input.slice(3)
        }
      }
    } else {
      // gt 0x00 means simply push value
      output.push(input[0])
      input = input.slice(1)
    }
  }
  return output
}

function deltaEncode(input) {
  let output = [input[0]]

  for (let i = 1; i < input.length; i++) {
    let diff = input[i] - input[i - 1]
    // I use 0xFF as a tag to detect negative numbers
    // as a difference of 0xFF only occurs in one situation 0x00 followed by 0xFF
    // If i used any other value, then there would be an increase of occurrences
    // thus lengthening the string. For example: using 0x00 as the tag would result in pairs
    // {0x00, 0x00}, {0x01, 0x01}, {X, X},... {0xFF, 0xFF} needing an extra tag to define
    // a singular difference between them

    if (diff === 255) {
      //  [..., 0xFF, 0XFF,... ] describes a difference of 0xFF
      output.push(255)
      output.push(255)
    } else if (diff < 0) {
      // [..., 0XFF, X,...] describes a negative difference of X
      output.push(255)
      output.push(-1 * diff)
    } else {
      output.push(diff)
    }
  }

  return output
}

function deltaDecode(input) {
  let output = [input[0]]
  let i = 1
  while (i < input.length) {
    if (input[i] === 255) {
      if (input[i + 1] === 255) {
        output.push(255)
      } else {
        output.push(output[output.length - 1] + -1 * input[i + 1])
      }

      // add 2 to the index because the output length should be 1 shorter when
      // 0XFF tag is detected
      i += 2
    } else {
      output.push(output[output.length - 1] + input[i])
      i++
    }
  }

  return output
}
