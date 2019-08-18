#!/bin/sh

ENVIRONMENT=${ENVIRONMENT:-dev}
REGION=${AWS_REGION:-us-east-1}

FILE_KEY=$1

if [[ -z "${FILE_KEY}" ]]; then
  echo "Missing argument <FILE_KEY>"
  exit 1
fi

if [[ -z "${IDENTIFIER}" ]]; then
  echo "Missing environment variable IDENTIFIER"
  exit 1
fi

S3_BUCKET=${S3_BUCKET:-`aws ssm get-parameter --region $REGION --name "/forum-post-to-pdf/${IDENTIFIER}" --query "Parameter.Value" --output text`}

if [[ -z "${S3_BUCKET}" ]]; then
  echo "Missing environment variable S3_BUCKET"
  exit 1
fi

echo "Processing ${FILE_KEY}"

INFILE=s3://${S3_BUCKET}/${FILE_KEY}
TEMPINFILE="$(mktemp).md"
TEMPOUTFILE="$(mktemp).pdf"
OUTFILE=s3://${S3_BUCKET}/pdf/${FILE_KEY}.pdf


aws s3 cp ${INFILE} ${TEMPINFILE}

echo "Processing ${INFILE} with Pandoc"

pandoc -N \
  --variable fontsize=12pt \
  --variable version=2.0 \
  ${TEMPINFILE} \
  --pdf-engine=xelatex \
  --toc \
  -o ${TEMPOUTFILE}

aws s3 cp ${TEMPOUTFILE} ${OUTFILE}
rc=$?

if [[ $rc != 0 ]]; then exit $rc; fi

echo Done
