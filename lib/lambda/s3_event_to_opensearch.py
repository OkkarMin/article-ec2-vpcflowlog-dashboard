import boto3
import os
import gzip
from opensearchpy import OpenSearch
from datetime import datetime
import pytz

auth = (os.environ.get("OPENSEARCH_USER"), os.environ.get("OPENSEARCH_PASSWORD"))
opensearch_host = os.environ.get("OPENSEARCH_HOST")
index = os.environ.get("OPENSEARCH_INDEX")
url = f"https://{opensearch_host}/{index}/_doc"
headers = {"Content-Type": "application/json"}

s3 = boto3.client("s3")

opensearch_client = OpenSearch(
    hosts=[{"host": opensearch_host, "port": 443}],
    http_auth=auth,
    http_compress=True,
    use_ssl=True,
    verify_certs=True,
    ssl_show_warn=False,
)


def handler(event, _) -> None:
    for record in event["Records"]:
        bucket = record["s3"]["bucket"]["name"]
        key = record["s3"]["object"]["key"]
        file_name = key.split("/")[-1]

        temp_file = f"/tmp/{file_name}"
        s3.download_file(Bucket=bucket, Key=key, Filename=temp_file)

        with gzip.open(temp_file, "rb") as f:
            for line in f:
                data = line.decode("utf-8").split()

                if data[0] == "version" or data[3] == "10.0.0.14":
                    continue

                date = datetime.fromtimestamp(
                    int(data[10]), pytz.timezone("Asia/Singapore")
                ).strftime("%Y-%m-%dT%H:%M:%S")

                document = {
                    "version": data[0],
                    "account_id": data[1],
                    "interface_id": data[2],
                    "ip_address": data[3],  # for opensearch to recognize
                    "src_addr": data[3],
                    "dst_addr": data[4],
                    "src_port": data[5],
                    "dst_port": data[6],
                    "protocol": data[7],
                    "packets": data[8],
                    "bytes": data[9],
                    "start": data[10],
                    "end": data[11],
                    "action": data[12],
                    "log_status": data[13],
                    "date": date,
                }

                response = opensearch_client.index(
                    index=index,
                    body=document,
                    refresh=True,  # refresh the index to make the document available for search
                )

                print(response)
